import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
// Loader function that fetches products

// export async function loader({ request, params }) {
//   const { id } = params; // Get the 'id' parameter from the URL
//   const productId = `gid://shopify/Product/${id}`;
//   const { admin } = await authenticate.admin(request);

//   try {
//     // GraphQL query to fetch a specific product by ID
//     const response = await admin.graphql(
//       `
//       query getProduct($id: ID!) {
//         product(id: $id) {
//           id
//           title
//           description
//           images(first: 1) {
//             edges {
//               node {
//                 originalSrc
//               }
//             }
//           }
//           variants(first: 1) {
//             edges {
//               node {
//                 id
//                 price
//               }
//             }
//           }
//         }
//       }
//       `,
//       { variables: { id: productId } }
//     );

//     // Log the raw response to inspect its structure
//     console.log("Raw response:", response);

//     // Access the product data
//     const data = await response.json(); // Make sure the response is parsed if it’s a Response object

//     const product = data?.data?.product;
//     if (!product) {
//       console.error("Product not found in response:", data);
//       throw new Response("Product not found", { status: 404 });
//     }

//     return json({ product }); // Return only the product data
//   } catch (error) {
//     console.error("Error fetching product data:", error);

//     // If the error has additional response information, log it
//     if (error.response) {
//       const errorText = await error.response.text();
//       console.error("API Error Response Text:", errorText);
//     }

//     throw new Response("Failed to fetch product data", { status: 500 });
//   }
// }


const debugLog = (message, data) => {
  console.log(`[Debug] ${message}`, {
    timestamp: new Date().toISOString(),
    ...data
  });
};

// Modified loader function for products.$id.link-sizing-chart.jsx
export async function loader({ request, params }) {
  debugLog("Link Sizing Chart Loader Started", { params });
  
  try {
    const { admin } = await authenticate.admin(request);
    const { id } = params;

    // Validate ID parameter
    if (!id) {
      throw new Error("Product ID is missing");
    }

    debugLog("Creating Product Global ID", { id });
    const productGlobalId = `gid://shopify/Product/${id}`;

    // Verify admin authentication
    if (!admin?.graphql) {
      throw new Error("Admin authentication failed");
    }

    debugLog("Fetching Product Data", { productGlobalId });
    const productResponse = await admin.graphql(
      `
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
        variables: { id: productGlobalId }  // Add variables property
      }
    );

    debugLog("Product Response Received", { 
      success: !!productResponse,
      hasData: !!productResponse?.data
    });

    // Parse and validate product data
    const productData = await productResponse.json();
    
    if (!productData?.data?.product) {
      throw new Error("Invalid product data received");
    }

    debugLog("Fetching Sizing Charts");
    const sizingCharts = await db.prisma.sizingChart.findMany().catch(error => {
      throw new Error(`Database query failed: ${error.message}`);
    });

    debugLog("Loader Completed Successfully", {
      hasProduct: !!productData.data.product,
      chartCount: sizingCharts.length
    });

    return json({
      product: productData.data.product,
      sizingCharts,
    });

  } catch (error) {
    debugLog("Loader Error", { 
      error: error.message,
      stack: error.stack
    });
    
    throw new Response(
      JSON.stringify({ 
        error: "Failed to load product or sizing charts",
        details: error.message
      }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
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