import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
// Loader function that fetches products

export async function loader({ request, params }) {
  const { id } = params; // Get the 'id' parameter from the URL
  const productId = `gid://shopify/Product/${id}`;
  const { admin } = await authenticate.admin(request);

  try {
    // GraphQL query to fetch a specific product by ID
    const response = await admin.graphql(
      `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
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
      `,
      { variables: { id: productId } }
    );

    // Log the raw response to inspect its structure
    console.log("Raw response:", response);

    // Access the product data
    const data = await response.json(); // Make sure the response is parsed if it’s a Response object

    const product = data?.data?.product;
    if (!product) {
      console.error("Product not found in response:", data);
      throw new Response("Product not found", { status: 404 });
    }

    return json({ product }); // Return only the product data
  } catch (error) {
    console.error("Error fetching product data:", error);

    // If the error has additional response information, log it
    if (error.response) {
      const errorText = await error.response.text();
      console.error("API Error Response Text:", errorText);
    }

    throw new Response("Failed to fetch product data", { status: 500 });
  }
}
// Component to display product information
export default function ProductSizing() {
  const { product } = useLoaderData(); // Access the product data from the loader
  console.log("Product data in component:", product); // Log to confirm data is accessible here

  return (
    <div>
      <h1>{product.title}</h1>
      <p>{product.description}</p>
      {product.images.edges.length > 0 && (
        <img src={product.images.edges[0].node.originalSrc} alt={product.title} />
      )}
      {product.variants.edges.length > 0 && (
        <p>Price: ${product.variants.edges[0].node.price}</p>
      )}
    </div>
  );
}