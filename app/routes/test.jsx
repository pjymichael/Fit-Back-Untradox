// app/routes/test.jsx
import { Page, Card, Button } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";
import { AppProvider } from "@shopify/polaris";

export default function Test() {
  return (
    <AppProvider i18n={translations}>
      <Page title="Test Page">
        <Card sectioned>
          <Button onClick={() => alert("Button works!")}>Test Button</Button>
        </Card>
      </Page>
    </AppProvider>
  );
}
