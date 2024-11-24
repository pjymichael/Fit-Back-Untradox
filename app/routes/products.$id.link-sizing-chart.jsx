import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Select,
  Button,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Loader to fetch product and available sizing charts
export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  // Fetch the product
  const productResponse = await admin.graphql(`
    query GetProduct($id: ID!) {
      product(id: "gid://shopify/Product/${id}") {
        id
        title
        metafields(namespace: "custom", keys: ["sizing_chart"]) {
          key
          value
        }
      }
    }
  `);

  // Fetch sizing charts
  const sizingCharts = await db.sizingChart.findMany();
  const productData = await productResponse.json();

  return json({
    product: productData.data.product,
    sizingCharts,
  });
}

// Action to update the metafield
export async function action({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const { id } = params;
  const formData = await request.formData();
  const sizingChartId = formData.get("sizingChartId");

  // Update the metafield
  await admin.graphql(`
    mutation UpdateProductMetafield {
      metafieldsSet(metafields: [{
        namespace: "custom",
        key: "sizing_chart",
        type: "single_line_text_field",
        value: "${sizingChartId}"
      }], resource: "gid://shopify/Product/${id}") {
        userErrors {
          field
          message
        }
      }
    }
  `);

  return redirect("/");
}

// Component
export default function LinkSizingChartPage() {
  const { product, sizingCharts } = useLoaderData();
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
                ...sizingCharts.map(chart => ({
                  label: `Sizing Chart ID: ${chart.id}`,
                  value: chart.id,
                })),
              ]}
              value={selectedSizingChart}
              onChange={handleSelectChange}
            />
            <Button
              primary
              onClick={() => {
                const formData = new FormData();
                formData.append("sizingChartId", selectedSizingChart);
                fetch(window.location.pathname, { method: "post", body: formData });
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