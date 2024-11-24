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
  const parsedSizingChartId = parseInt(sizingChartId, 10);
  
  if (isNaN(parsedSizingChartId)) {
    return json({ error: "Invalid Sizing Chart ID" }, { status: 400 });
  }

  try {
    const response = await admin.graphql(
      `#graphql
      mutation LinkSizingChart($input: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $input) {
          metafields {
            id
            key
            namespace
            value
            type
          }
          userErrors {
            field
            message
            code
          }
        }
      }
      `,
      {
        variables: {
          input: [
            {
              namespace: "custom",
              key: "sizing_chart",
              value: parsedSizingChartId.toString(), // Shopify requires the value as a string even for number_integer
              type: "number_integer",
              ownerId: productGlobalId,
            },
          ],
        },
      }
    );

    const responseJson = await response.json();
    console.log("Metafield update response:", JSON.stringify(responseJson, null, 2));

    if (responseJson.errors?.length > 0) {
      console.error("GraphQL errors:", responseJson.errors);
      return json({ 
        error: "GraphQL Error",
        details: responseJson.errors[0].message 
      }, { status: 400 });
    }

    if (responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
      const errors = responseJson.data.metafieldsSet.userErrors;
      console.error("Metafield update errors:", errors);
      return json({ 
        error: "Failed to update metafield",
        details: errors 
      }, { status: 400 });
    }

    if (!responseJson.data?.metafieldsSet?.metafields?.length) {
      return json({ 
        error: "No metafield was created",
        details: "The mutation completed but no metafield was returned" 
      }, { status: 400 });
    }

    return redirect("/app");
  } catch (error) {
    console.error("Action Error:", error);
    return json({ 
      error: "Failed to link sizing chart",
      details: error.message 
    }, { status: 500 });
  }
}
// Client-side component
export default function LinkSizingChartPage() {
  const { product, sizingCharts } = useLoaderData();
  const navigate = useNavigate();
  const [selectedSizingChart, setSelectedSizingChart] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectChange = (value) => {
    setSelectedSizingChart(value);
    setError(null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("sizingChartId", selectedSizingChart);

    try {
      const response = await fetch(window.location.pathname, {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);
      
      if (response.ok) {
        navigate("/app");
      } else {
        const errorMessage = result?.details 
          ? `${result.error}: ${JSON.stringify(result.details)}`
          : result?.error || "Failed to link sizing chart. Please try again.";
        setError(errorMessage);
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Page title={`Link Sizing Chart to ${product.title}`}>
      <Layout>
        <Layout.Section>
          {error && (
            <Banner status="critical" title="Error">
              <p>{error}</p>
            </Banner>
          )}
          <Card title="Select a Sizing Chart" sectioned>
            <Select
              label="Sizing Chart"
              options={[
                { label: "Select a Sizing Chart", value: "" },
                ...sizingCharts.map((chart) => ({
                  label: `Sizing Chart ID: ${chart.id}`,
                  value: chart.id.toString(),
                })),
              ]}
              value={selectedSizingChart}
              onChange={handleSelectChange}
            />
            <div style={{ marginTop: "1rem" }}>
              <Button
                primary
                onClick={handleSubmit}
                disabled={!selectedSizingChart || isLoading}
                loading={isLoading}
              >
                Link Sizing Chart
              </Button>
            </div>
          </Card>
          <div style={{ marginTop: "1rem" }}>
            <Button onClick={() => navigate(-1)}>Back</Button>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}