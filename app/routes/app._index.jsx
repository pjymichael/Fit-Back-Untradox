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

// Loader function that fetches products and sizing charts
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  // GraphQL query to fetch the first 50 products from Shopify
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
          }
        }
      }
    }
  `);

  // Parse the JSON response and extract product data
  const productData = await productResponse.json();
  const products = productData.data.products.edges.map(edge => edge.node);

  // Fetch sizing chart data from the Prisma database
  const sizingCharts = await db.sizingChart.findMany({
    include: { sizes: true } // Include associated sizes if you have a relation
  });

  return json({ products, sizingCharts });
}

// Client-side component to display products and sizing charts
export default function HomePage() {
  const { products, sizingCharts } = useLoaderData(); // Access data from loader
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);

  const handleTabChange = (selectedTabIndex) => setSelectedTab(selectedTabIndex);

  const tabs = [
    { id: "products-tab", content: "Products", panelID: "products-content" },
    { id: "sizing-charts-tab", content: "Sizing Charts", panelID: "sizing-charts-content" },
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
                    <Button onClick={() => {
                      const numericId = product.id.split("/").pop(); // Extract numeric ID
                      navigate(`/products/${numericId}/sizing`);
                    }}>
                      Link Sizing Chart
                    </Button>
                  </Card>
                </Layout.Section>
              ))
            )}
            {/* Sizing Charts Tab */}
            {selectedTab === 1 && (
              <Layout.Section>
                <Button
                  primary
                  onClick={() => navigate("app/sizingchart")}
                  
                >
                  Add Sizing Chart
                </Button>
                {sizingCharts.length > 0 ? (
                  sizingCharts.map((chart) => (
                    <Card key={chart.id} title={`Sizing Chart for Product ${chart.productId}`} sectioned>
                      <Text as="p">Created At: {new Date(chart.createdAt).toLocaleDateString()}</Text>
                      <Text as="p">Updated At: {new Date(chart.updatedAt).toLocaleDateString()}</Text>
                      {chart.sizes.map((size) => (
                        <Card key={size.id} title={`Size: ${size.label}`} sectioned>
                          <Text>Chest: {size.chest || "N/A"}</Text>
                          <Text>Waist: {size.waist || "N/A"}</Text>
                          <Text>Shoulders: {size.shoulders || "N/A"}</Text>
                          <Text>Sleeve: {size.sleeve || "N/A"}</Text>
                          {/* Add more size details as needed */}
                        </Card>
                      ))}
                    </Card>
                  ))
                ) : (
                  <Card title="Sizing Charts" sectioned>
                    <Text as="p">No sizing charts available. You can add new sizing charts here.</Text>
                  </Card>
                )}
              </Layout.Section>
            )}
          </Layout>
        </Layout.Section>
      </Tabs>
    </Page>
  );
}
