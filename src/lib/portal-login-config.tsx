import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  FileText,
  IndianRupee,
  LineChart,
  Package,
  Radio,
  Shield,
  Truck,
  Users,
  Workflow,
} from "lucide-react";

export type PortalLoginVariant = "selection" | "client" | "employee" | "vendor";

export type PortalHeroFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type PortalHeroConfig = {
  variant?: PortalLoginVariant;
  backgroundImage: string;
  /** CSS background-position — truck/scene should sit on the right, copy on the left */
  backgroundPosition?: string;
  eyebrow?: string;
  headline: ReactNode;
  description: string;
  features: PortalHeroFeature[];
  tagline: string;
};

export const PORTAL_HERO: Record<PortalLoginVariant, PortalHeroConfig> = {
  selection: {
    variant: "selection",
    backgroundImage: "/auth/portal-hero-selection.webp",
    backgroundPosition: "88% center",
    eyebrow: "TRANSPORT MANAGEMENT SYSTEM",
    headline: (
      <>
        A connected workspace for <span className="text-[#F5D33C]">every movement.</span>
      </>
    ),
    description:
      "Manage transportation, track shipments, collaborate with partners, and keep your operations moving — all in one place.",
    features: [
      {
        icon: Workflow,
        title: "Simpler Operations",
        description: "From requirements to delivery, manage it all seamlessly.",
      },
      {
        icon: Radio,
        title: "Real-time Visibility",
        description: "Stay informed at every mile.",
      },
      {
        icon: Users,
        title: "A Stronger Ecosystem",
        description: "Bring clients, vendors, drivers and teams together.",
      },
    ],
    tagline: "Every Move Connected.",
  },
  client: {
    variant: "client",
    backgroundImage: "/auth/portal-hero-client.webp",
    backgroundPosition: "90% center",
    eyebrow: "CLIENT PORTAL",
    headline: (
      <>
        Move your business forward <span className="text-[#F5D33C]">with confidence.</span>
      </>
    ),
    description:
      "Create requirements, track shipments, manage documents and stay in control of your logistics — all in one place.",
    features: [
      {
        icon: Package,
        title: "Create & Manage",
        description: "Raise requirements and track end-to-end movement.",
      },
      {
        icon: Radio,
        title: "Real-time Visibility",
        description: "Stay updated at every mile.",
      },
      {
        icon: FileText,
        title: "Documents & Compliance",
        description: "Access PODs, invoices and reports.",
      },
      {
        icon: LineChart,
        title: "Better Control",
        description: "Monitor spend and improve your logistics performance.",
      },
    ],
    tagline: "Connected Logistics. Simplified.",
  },
  employee: {
    variant: "employee",
    backgroundImage: "/auth/portal-hero-employee.webp",
    backgroundPosition: "72% center",
    eyebrow: "INTERNAL OPERATIONS PORTAL",
    headline: (
      <>
        People. Operations. <span className="text-[#F5D33C]">A Stronger Network.</span>
      </>
    ),
    description:
      "Access your workspace, manage operations, collaborate with teams and keep the logistics ecosystem moving.",
    features: [
      {
        icon: Workflow,
        title: "Streamline Operations",
        description: "Manage indents, allocations and trips.",
      },
      {
        icon: LineChart,
        title: "Real-time Insights",
        description: "Monitor performance and take action.",
      },
      {
        icon: Users,
        title: "Collaborate Seamlessly",
        description: "Stay aligned across teams and partners.",
      },
      {
        icon: Shield,
        title: "Drive Better Outcomes",
        description: "Ensure compliance and operational excellence.",
      },
    ],
    tagline: "Behind Every Movement A Stronger Team.",
  },
  vendor: {
    variant: "vendor",
    backgroundImage: "/auth/portal-hero-vendor.webp",
    backgroundPosition: "90% center",
    eyebrow: "TRANSPORTER PORTAL",
    headline: (
      <>
        More Loads. <span className="text-[#F5D33C]">Stronger Partnerships.</span> A Connected Tomorrow.
      </>
    ),
    description:
      "Access available loads, manage your fleet and drivers, track trips and grow your business with ShunLink.",
    features: [
      {
        icon: Package,
        title: "Find Opportunities",
        description: "Access verified loads and quotes.",
      },
      {
        icon: Truck,
        title: "Manage Operations",
        description: "Manage vehicles, drivers and trips.",
      },
      {
        icon: IndianRupee,
        title: "Track Earnings",
        description: "Get transparent and timely payments.",
      },
      {
        icon: BarChart3,
        title: "Build Long-term Growth",
        description: "Be part of a trusted logistics network.",
      },
    ],
    tagline: "Together We Move More Possibilities.",
  },
};

export type PortalRoleCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  cardBg: string;
  borderColor: string;
};

export const PORTAL_ROLE_CARDS: PortalRoleCard[] = [
  {
    href: "/login/client",
    title: "Client",
    description: "Manage requirements, track shipments, view documents and more.",
    icon: Building2,
    iconBg: "bg-[#FFF4D6]",
    iconColor: "text-[#B45309]",
    cardBg: "bg-[#FFFBF0]",
    borderColor: "border-[#F5E6B8]",
  },
  {
    href: "/login/employee",
    title: "Employee",
    description: "Access internal operations, manage workflows and collaborate with teams.",
    icon: Users,
    iconBg: "bg-[#E8F0FE]",
    iconColor: "text-[#1D4ED8]",
    cardBg: "bg-[#F5F8FF]",
    borderColor: "border-[#D6E4FF]",
  },
  {
    href: "/login/vendor",
    title: "Vendor / Transporter",
    description: "Access loads, manage trips, and coordinate operations.",
    icon: Truck,
    iconBg: "bg-[#E6F6EE]",
    iconColor: "text-[#15803D]",
    cardBg: "bg-[#F3FBF6]",
    borderColor: "border-[#C8EBD8]",
  },
];
