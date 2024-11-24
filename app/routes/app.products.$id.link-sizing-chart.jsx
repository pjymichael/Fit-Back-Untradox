import { json, redirect } from "@remix-run/node"; // Handle server-side logic
import { useLoaderData, useNavigate } from "@remix-run/react"; // For navigation and data fetching
import {useState} from "react"
import {
  Page,
  Layout,
  Card,
  Select,
  Button,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Loader to fetch product and sizing charts
export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  // Validate ID format
  if (!id || isNaN(id)) {
    throw new Response(
      JSON.stringify({ error: "Invalid product ID format" }),
      { status: 400 }
    );
  }

  const productGlobalId = `gid://shopify/Product/${id}`;

  try {
    // Execute GraphQL query with proper structure
    const response = await admin.graphql(
      `#graphql
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          metafield(namespace: "custom", key: "sizing_chart") {
            value
          }
        }
      }
      `,
      {
        variables: { id: productGlobalId }
      }
    );

    // Parse response properly
    const responseJson = await response.json();
    
    // Validate response structure
    if (!responseJson.data?.product) {
      throw new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404 }
      );
    }

    // Fetch sizing charts with error handling
    const sizingCharts = await db.sizingChart.findMany({
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        sizes: {
          select: {
            id: true,
            label: true,
            measurements: true
          }
        }
      }
    }).catch(error => {
      console.error("Database error:", error);
      throw new Response(
        JSON.stringify({ error: "Failed to fetch sizing charts" }),
        { status: 500 }
      );
    });

    // Return successful response
    return json({
      product: responseJson.data.product,
      sizingCharts
    });

  } catch (error) {
    console.error("Loader error:", error);
    
    // Handle different types of errors
    if (error instanceof Response) {
      throw error;
    }

    if (error.message?.includes("network")) {
      throw new Response(
        JSON.stringify({ 
          error: "Network error", 
          message: "Please check your connection and try again" 
        }),
        { status: 503 }
      );
    }

    throw new Response(
      JSON.stringify({ 
        error: "Failed to load product or sizing charts",
        message: error.message
      }),
      { status: 500 }
    );
  }
}

// Action to link sizing chart
export async function action({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const { id } = params;
  const productGlobalId = `gid://shopify/Product/${id}`;
  const formData = await request.formData();
  const sizingChartId = formData.get("sizingChartId");

  console.log("Linking sizing chart:", { productGlobalId, sizingChartId });

  try {
    // Update metafield
    const response = await admin.graphql(
      `
      mutation LinkSizingChart($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            value
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        metafields: [
          {
            namespace: "custom",
            key: "sizing_chart",
            value: sizingChartId,
            type: "integer",
            ownerId: productGlobalId,
          },
        ],
      }
    );

    console.log("Metafield update response:", response);

    if (response?.metafieldsSet?.userErrors?.length > 0) {
      console.error("User errors:", response.metafieldsSet.userErrors);
      throw new Error("Failed to update metafield due to user errors.");
    }

    return redirect("/");
  } catch (error) {
    console.error("Action Error:", error);
    throw new Response("Failed to link sizing chart", {
      status: 500,
    });
  }
}

// Client-side component
export default function LinkSizingChartPage() {
  const { product, sizingCharts } = useLoaderData(); // Access data
  const navigate = useNavigate();
  const [selectedSizingChart, setSelectedSizingChart] = useState("");

  const handleSelectChange = (value) => setSelectedSizingChart(value);

  return (
    <Page title={`Link Sizing Chart to ${product.title}`}>
      <Layout>
        <Layout.Section>
          <Card title="Select a Sizing Chart" sectioned>
            <Select
              label="Sizing Chart"
              options={[
                { label: "Select a Sizing Chart", value: "" },
                ...sizingCharts.map((chart) => ({
                  label: `Sizing Chart ID: ${chart.id}`,
                  value: chart.id,
                })),
              ]}
              value={selectedSizingChart}
              onChange={handleSelectChange}
            />
            <Button
              primary
              onClick={async () => {
                const formData = new FormData();
                formData.append("sizingChartId", selectedSizingChart);

                const response = await fetch(window.location.pathname, { 
                  method: "post", 
                  body: formData 
                });

                if (response.ok) {
                  alert("Sizing Chart linked successfully!");
                  navigate("/");
                } else {
                  const error = await response.json();
                  console.error("Error linking sizing chart:", error);
                  alert("Failed to link sizing chart. Please try again.");
                }
              }}
              disabled={!selectedSizingChart}
            >
              Link Sizing Chart
            </Button>
          </Card>
          <Button onClick={() => navigate(-1)}>Back</Button>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
