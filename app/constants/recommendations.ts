import type { RecommendationType, RecommendationSubType } from "@prisma/client";
import type { FunctionComponent, SVGProps } from "react";
import type { Tone } from "@shopify/polaris/build/ts/src/components/Badge";
import {
  AlertTriangleIcon,
  CartDiscountIcon,
  CashDollarIcon,
  DisabledIcon,
  DiscountFilledIcon,
  DiscountIcon,
  GiftCardIcon,
  ImageAltIcon,
  InventoryFilledIcon,
  InventoryIcon,
  PauseCircleIcon,
  TextBlockIcon,
  TextIcon,
  TextInRowsIcon,
  TextTitleIcon,
} from "@shopify/polaris-icons";

interface SubTypeDefinition {
  type: RecommendationSubType;
  label: string;
  tone: Tone;
  icon: FunctionComponent<SVGProps<SVGSVGElement>>;
}

interface TabDefinition {
  content: string;
  subTypes: SubTypeDefinition[];
}

export const TAB_DEFINITIONS: Record<RecommendationType, TabDefinition> = {
  PRICING: {
    content: "Pricing",
    subTypes: [
      {
        type: "CHEAP",
        label: "Cheap",
        tone: "success",
        icon: DiscountIcon,
      },
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
        icon: GiftCardIcon,
      },
      {
        type: "SALE_AT_LOSS",
        label: "Sale at Loss",
        tone: "critical",
        icon: AlertTriangleIcon,
      },
      {
        type: "LOW_DISCOUNT",
        label: "Low Discount",
        tone: "attention",
        icon: CartDiscountIcon,
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
      {
        type: "SHORT_TITLE",
        label: "Short Title",
        tone: "info",
        icon: TextIcon,
      },
      {
        type: "LONG_TITLE",
        label: "Long Title",
        tone: "info-strong",
        icon: TextTitleIcon,
      },
      {
        type: "SHORT_DESCRIPTION",
        label: "Short Desc.",
        tone: "info",
        icon: TextBlockIcon,
      },
      {
        type: "LONG_DESCRIPTION",
        label: "Long Desc.",
        tone: "info-strong",
        icon: TextInRowsIcon,
      },
      {
        type: "NO_IMAGE",
        label: "No Image",
        tone: "critical",
        icon: ImageAltIcon,
      },
    ],
  },
  STOCK: {
    content: "Inventory",
    subTypes: [
      {
        type: "UNDERSTOCK",
        label: "Low Stock",
        tone: "warning",
        icon: InventoryIcon,
      },
      {
        type: "OVERSTOCK",
        label: "High Stock",
        tone: "attention",
        icon: InventoryFilledIcon,
      },
      {
        type: "NO_STOCK",
        label: "Out of Stock",
        tone: "critical-strong",
        icon: DisabledIcon,
      },
      {
        type: "PASSIVE",
        label: "Inactive Product",
        tone: "read-only",
        icon: PauseCircleIcon,
      },
    ],
  },
};

export function getSubTypeDefinition(
  subType: RecommendationSubType,
): SubTypeDefinition {
  for (const definition of Object.values(TAB_DEFINITIONS)) {
    const found = definition.subTypes.find((st) => st.type === subType);
    if (found) return found;
  }
  throw new Error(`Unknown subtype: ${subType}`);
}
