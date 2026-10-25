"use client";

import { Download, FileSignature } from "lucide-react";
import OnboardingDocuments from "@/components/forms/onboarding-documents";
import { CLIENT_ONBOARDING_AGREEMENT_DOC } from "@/lib/onboarding-docs";
import { CLIENT_ONBOARDING_AGREEMENT_TEMPLATE_URL } from "@/lib/client-onboarding-fields";

type Doc = { id: string; type: string; url: string; name: string | null };

export default function ClientOnboardingAgreementPanel({
  documents,
  readOnly,
  onDocumentsChange,
  ownerType,
  ownerId,
}: {
  documents: Doc[];
  readOnly?: boolean;
  onDocumentsChange?: (documents: Doc[]) => void;
  ownerType?: "client" | "vendor";
  ownerId?: string;
}) {
  const agreementDocs = documents.filter((d) => d.type === CLIENT_ONBOARDING_AGREEMENT_DOC.type);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <FileSignature className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">Agreement</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Download the Shunlink client agreement, sign it, and upload a copy here. This step is optional —
              you can submit onboarding without it, but a complete application includes the signed agreement.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4">
          <p className="text-sm text-slate-600 flex-1">
            Use the template below. Replace this file with your legal PDF when ready.
          </p>
          <a
            href={CLIENT_ONBOARDING_AGREEMENT_TEMPLATE_URL}
            download
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl gap-2 shrink-0 h-11 px-5 py-2 text-sm font-semibold border border-input bg-background hover:bg-muted text-foreground transition-colors"
          >
            <Download className="h-4 w-4" />
            Download agreement (PDF)
          </a>
        </div>

        <div className="portal-onboarding-docs">
          <OnboardingDocuments
            endpoint={ownerType && ownerId ? undefined : "/api/portal/documents"}
            ownerType={ownerType}
            ownerId={ownerId}
            documents={agreementDocs}
            docTypes={[CLIENT_ONBOARDING_AGREEMENT_DOC]}
            onDocumentsChange={(next) => {
              const other = documents.filter((d) => d.type !== CLIENT_ONBOARDING_AGREEMENT_DOC.type);
              onDocumentsChange?.([...other, ...next]);
            }}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
