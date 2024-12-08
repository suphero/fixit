import { useCallback, useState } from "react";
import {
  Page,
  Tabs,
  Card,
  Text,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function Index() {
  const [selected, setSelected] = useState(0);

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelected(selectedTabIndex),
    [],
  );

  const tabs = [
    {
      id: 'all-customers-1',
      content: 'All',
      accessibilityLabel: 'All customers',
      panelID: 'all-customers-content-1',
    },
    {
      id: 'accepts-marketing-1',
      content: 'Accepts marketing',
      panelID: 'accepts-marketing-content-1',
    },
    {
      id: 'repeat-customers-1',
      content: 'Repeat customers',
      panelID: 'repeat-customers-content-1',
    },
    {
      id: 'prospects-1',
      content: 'Prospects',
      panelID: 'prospects-content-1',
    }
  ];

  return (
    <Page>
      <TitleBar title="Recommendations">
      </TitleBar>
      <Card>
        <Tabs tabs={tabs} selected={selected} onSelect={handleTabChange}>
          <Text as="h2" variant="headingSm">
            {tabs[selected].content}
          </Text>
          <Box>
            <Text as="p" variant="bodyMd">
              Tab {selected} selected
            </Text>
          </Box>
        </Tabs>
      </Card>
    </Page>
  );
}
