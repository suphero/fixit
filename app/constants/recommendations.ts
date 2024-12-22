import type { RecommendationType } from "@prisma/client";
import type { FunctionComponent, SVGProps } from "react";
import type { Tone } from "@shopify/polaris/build/ts/src/components/Badge";
import {
  DiscountIcon,
  CashDollarIcon,
  GiftCardIcon,
  UnknownDeviceIcon,
  DiscountFilledIcon,
  DisabledIcon,
} from "@shopify/polaris-icons";

// Define our own SubType enum to match prisma schema
export type RecommendationSubType =
  // Pricing related
  | "CHEAP"
  | "EXPENSIVE"
  | "NO_COST"
  | "SALE_AT_LOSS"
  | "LOW_DISCOUNT"
  | "HIGH_DISCOUNT"

  // Definition related
  | "SHORT_TITLE"
  | "LONG_TITLE"
  | "SHORT_DESCRIPTION"
  | "LONG_DESCRIPTION"
  | "NO_IMAGE"

  // Stock related
  | "UNDERSTOCK"
  | "OVERSTOCK"
  | "NO_STOCK"
  | "PASSIVE";

interface SubTypeDefinition {
  type: RecommendationSubType;
  label: string;
  tone: Tone;
  icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
}

interface TabDefinition {
  content: string;
  subTypes: SubTypeDefinition[];
}

export const TAB_DEFINITIONS: Record<RecommendationType, TabDefinition> = {
  PRICING: {
    content: "Pricing",
    subTypes: [
      { type: "CHEAP", label: "Cheap", tone: "success", icon: DiscountIcon },
      {
        type: "EXPENSIVE",
        label: "Expensive",
        tone: "warning",
        icon: CashDollarIcon,
      },
      {
        type: "NO_COST",
        label: "No Cost",
        tone: "info",
        icon: UnknownDeviceIcon,
      },
      {
        type: "SALE_AT_LOSS",
        label: "Sale at Loss",
        tone: "critical",
        icon: GiftCardIcon,
      },
      {
        type: "LOW_DISCOUNT",
        label: "Low Discount",
        tone: "attention",
        icon: DiscountIcon,
      },
      {
        type: "HIGH_DISCOUNT",
        label: "High Discount",
        tone: "success-strong",
        icon: DiscountFilledIcon,
      },
    ],
  },
  DEFINITION: {
    content: "Content",
    subTypes: [
      { type: "SHORT_TITLE", label: "Short Title", tone: "info" },
      { type: "LONG_TITLE", label: "Long Title", tone: "info-strong" },
      { type: "SHORT_DESCRIPTION", label: "Short Description", tone: "info" },
      {
        type: "LONG_DESCRIPTION",
        label: "Long Description",
        tone: "info-strong",
      },
      {
        type: "NO_IMAGE",
        label: "No Image",
        tone: "critical",
        icon: UnknownDeviceIcon,
      },
    ],
  },
  STOCK: {
    content: "Inventory",
    subTypes: [
      { type: "UNDERSTOCK", label: "Low Stock", tone: "warning" },
      { type: "OVERSTOCK", label: "High Stock", tone: "attention" },
      {
        type: "NO_STOCK",
        label: "Out of Stock",
        tone: "critical-strong",
        icon: DisabledIcon,
      },
      { type: "PASSIVE", label: "Inactive Product", tone: "read-only" },
    ],
  },
};

export function getSubTypeDefinition(subType: RecommendationSubType): SubTypeDefinition {
  for (const definition of Object.values(TAB_DEFINITIONS)) {
    const found = definition.subTypes.find((st) => st.type === subType);
    if (found) return found;
  }
  throw new Error(`Unknown subtype: ${subType}`);
}
