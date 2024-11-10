import { json } from "@remix-run/node"; // For server-side data handling in the loader
import { useLoaderData, useNavigate } from "@remix-run/react"; // Import useLoaderData to access loader data in the component
import {
  Page,
  Layout,
  Text,
  Card,
  Thumbnail,
  Button
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// Loader function that fetches products
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  // GraphQL query to fetch the first 50 products
  const response = await admin.graphql(`
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

  // Parse the JSON response and structure data for the component
  const data = await response.json();
  const products = data.data.products.edges.map(edge => edge.node);

  return json({ products });
}

// Client-side component to display products
export default function ProductList() {
  const { products } = useLoaderData(); // Access data from loader
  const navigate = useNavigate();
  return (
    <Page title="Product List">
      <Layout>
        {products.map((product) => (
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
                console.log("Navigating to:", `products/${numericId}/sizing`);
                navigate(`/products/${numericId}/sizing`);
              }}>
                Add Sizing information
              </Button>
            </Card>
          </Layout.Section>
        ))}
      </Layout>
    </Page>
  );
}
