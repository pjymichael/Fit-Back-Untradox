import { json } from "@remix-run/node"; // For server-side data handling in the loader
import { useLoaderData, useNavigate } from "@remix-run/react"; // Import useLoaderData to access loader data in the component
import { useState } from "react";

import {
  Page,
  Layout,
  Text,
  Card,
  Thumbnail,
  Button,
  Tabs,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server"; // Import your Prisma database instance
import SizingMatch from "./app.sizingMatch";
const debugLog = (message, data) => {
  console.log(`[Debug] ${message}`, {
    timestamp: new Date().toISOString(),
    ...data
  });
};
// Loader function that fetches products and sizing charts
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  // GraphQL query to fetch products and metafields
// GraphQL query to fetch products and metafields
  const productResponse = await admin.graphql(`
    query getAllProducts {
      products(first: 50) {
        edges {
          node {
            id
            title
            handle
            description
            images(first: 1) {
              edges {
                node {
                  originalSrc
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                }
              }
            }
            metafield(namespace: "custom", key: "sizing_chart") {
              namespace
              key
              value
            }
          }
        }
      }
    }
  `);


  // Parse the JSON response and extract product data
  const productData = await productResponse.json();
  const products = productData.data.products.edges.map((edge) => {
    const metafieldNode = edge.node.metafield; // Extract metafield node directly
    return {
      ...edge.node,
      metafield: metafieldNode ? { key: metafieldNode.key, value: metafieldNode.value } : null,
    };
  });
  // Fetch sizing chart data from the Prisma database
  const sizingCharts = await db.sizingChart.findMany({
    include: {
      sizes: {
        include: {
          measurements: true, // Fetch nested measurements within each size
        },
      },
    },
  });
  return json({ products, sizingCharts });
}

// Client-side component to display products and sizing charts
export default function HomePage() {
  const { products, sizingCharts } = useLoaderData(); // Access data from loader
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);
  const handleLinkSizingChart = (productId) => {
    // Extract the numeric ID from the full Shopify ID
    const cleanId = productId.split('/').pop();
    debugLog("Navigating to Link Sizing Chart", {
      originalId: productId,
      cleanId
    });
    navigate(`/app/products/${cleanId}/link-sizing-chart`);
  };
  const handleTabChange = (selectedTabIndex) => setSelectedTab(selectedTabIndex);

  const tabs = [
    { id: "products-tab", content: "Products", panelID: "products-content" },
    { id: "sizing-charts-tab", content: "Sizing Charts", panelID: "sizing-charts-content" },
    { id: "sizing-match-tab", content: "Find My Size", panelID: "sizing-match-content" },
  ];

  return (
    <Page title="Product and Sizing Information">
      <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} fitted>
        <Layout.Section>
          <Layout>
            {/* Products Tab */}
            {selectedTab === 0 && (
              products.map((product) => (
                <Layout.Section key={product.id}>
                  <Card title={product.title} sectioned>
                    <Thumbnail
                      source={product.images.edges[0]?.node.originalSrc || ""}
                      alt={product.title}
                      size="small"
                    />
                    <Text as="p">{product.description || "No description available."}</Text>
                    <Text as="p">Price: ${product.variants.edges[0]?.node.price || "N/A"}</Text>
                    {/* Display linked sizing chart ID if it exists */}
                    {product.metafield ? (
                      <Text as="p">
                        Linked Sizing Chart ID: {product.metafield.value}
                      </Text>
                    ) : (
                      <Text as="p">No sizing chart linked.</Text>
                    )}
                    {/* Button to link a sizing chart */}
                    <Button
                      onClick={() => handleLinkSizingChart(product.id)}
                      // Replace your existing navigation onClick
                    >
                      Link Sizing Chart
                    </Button>
                  </Card>
                </Layout.Section>
              ))
            )}
            {/* Sizing Charts Tab */}
            {selectedTab === 1 && (
            <Layout.Section>
              <Button primary onClick={() => navigate("/app/sizingchart")}>
                Add Sizing Chart
              </Button>
              {sizingCharts.length > 0 ? (
                sizingCharts.map((chart) => (
                  <Card key={chart.id} title={`Sizing Chart ID: ${chart.id}`} sectioned>
                    <Text as="p">Created At: {new Date(chart.createdAt).toLocaleDateString()}</Text>
                    <Text as="p">Updated At: {new Date(chart.updatedAt).toLocaleDateString()}</Text>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1em" }}>
                      <thead>
                        <tr>
                          <th style={{ border: "1px solid #ccc", padding: "8px" }}>Size Label</th>
                          {chart.sizes[0]?.measurements.map((measurement, index) => (
                            <th key={index} style={{ border: "1px solid #ccc", padding: "8px" }}>
                              {measurement.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chart.sizes.map((size) => (
                          <tr key={size.id}>
                            <td style={{ border: "1px solid #ccc", padding: "8px" }}>{size.label}</td>
                            {size.measurements.map((measurement, index) => (
                              <td key={index} style={{ border: "1px solid #ccc", padding: "8px" }}>
                                {measurement.value} {measurement.unit || ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                ))
              ) : (
                <Card title="Sizing Charts" sectioned>
                  <Text as="p">No sizing charts available. You can add new sizing charts here.</Text>
                </Card>
              )}
            </Layout.Section>
          )}
            {selectedTab === 2 && (
                <Layout.Section>
                <Button>Hi</Button>
                <SizingMatch />
              </Layout.Section>
            )}
          </Layout>
        </Layout.Section>
      </Tabs>
    </Page>
  );
}
