import React, { useState } from "react";
import { AppProvider, Page, Card, TextField, Button, FormLayout } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";

export default function BasicPolarisTemplate() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = () => {
    console.log("Name:", name);
    console.log("Email:", email);
  };

  return (
    <AppProvider i18n={translations}>
      <Page title="Basic Polaris Template">
        <Card sectioned>
          <FormLayout>
            <TextField
              label="Name"
              value={name}
              onChange={setName}
              autoComplete="off"
            />
            <TextField
              type="email"
              label="Email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Button primary onClick={handleSubmit}>
              Submit
            </Button>
          </FormLayout>
        </Card>
      </Page>
    </AppProvider>
  );
}
