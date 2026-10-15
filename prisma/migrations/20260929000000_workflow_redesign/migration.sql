-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATIONS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT,
    "vendorId" TEXT,
    "driverId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "module" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role","permissionId")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "landmark" TEXT,
    "lat" DECIMAL(65,30),
    "lng" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "accountHolder" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifsc" TEXT,
    "branch" TEXT,
    "upiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingCase" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 's3',
    "storageBucket" TEXT,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAttachment" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LookupCatalog" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "meta" TEXT,

    CONSTRAINT "LookupCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "code" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "altPhone" TEXT,
    "email" TEXT,
    "accountsEmail" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "cin" TEXT,
    "msme" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAddress" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClientAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCommercial" (
    "clientId" TEXT NOT NULL,
    "creditLimit" DECIMAL(65,30),
    "paymentTermsDays" INTEGER,
    "securityDeposit" DECIMAL(65,30),
    "bankAccountId" TEXT,

    CONSTRAINT "ClientCommercial_pkey" PRIMARY KEY ("clientId")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FLEET_OWNER',
    "contactName" TEXT,
    "phone" TEXT,
    "altPhone" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "msme" TEXT,
    "rating" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorAddress" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REGISTERED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VendorAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCommercial" (
    "vendorId" TEXT NOT NULL,
    "paymentTermsDays" INTEGER,
    "tdsApplicable" BOOLEAN NOT NULL DEFAULT false,
    "bankAccountId" TEXT,

    CONSTRAINT "VendorCommercial_pkey" PRIMARY KEY ("vendorId")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dlNumber" TEXT NOT NULL,
    "dlExpiry" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "deviceType" TEXT NOT NULL DEFAULT 'SMARTPHONE',
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "accountStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "registrationNumber" TEXT NOT NULL,
    "vehicleTypeCode" TEXT NOT NULL,
    "bodyTypeCode" TEXT,
    "capacityTons" DECIMAL(65,30),
    "capacityCbm" DECIMAL(65,30),
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "ownership" TEXT DEFAULT 'ATTACHED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCompliance" (
    "vehicleId" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationRemarks" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rcNumber" TEXT,
    "rcExpiry" TIMESTAMP(3),
    "ownerName" TEXT,
    "ownerPan" TEXT,
    "insuranceNumber" TEXT,
    "insuranceCompany" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "insuranceValue" DECIMAL(65,30),
    "fitnessExpiry" TIMESTAMP(3),
    "pucNumber" TEXT,
    "pucExpiry" TIMESTAMP(3),
    "permitType" TEXT,
    "permitNumber" TEXT,
    "permitExpiry" TIMESTAMP(3),

    CONSTRAINT "VehicleCompliance_pkey" PRIMARY KEY ("vehicleId")
);

-- CreateTable
CREATE TABLE "VehicleTelematics" (
    "vehicleId" TEXT NOT NULL,
    "gpsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gpsDeviceId" TEXT,
    "fastagId" TEXT,

    CONSTRAINT "VehicleTelematics_pkey" PRIMARY KEY ("vehicleId")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "reqNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "routeFrom" TEXT NOT NULL,
    "routeTo" TEXT NOT NULL,
    "vehicleTypeCode" TEXT NOT NULL,
    "vehicleQuantity" INTEGER NOT NULL DEFAULT 1,
    "cargoSummary" TEXT,
    "expectedAt" TIMESTAMP(3),
    "clientRate" DECIMAL(65,30),
    "bodyTypeCode" TEXT,
    "insuranceType" TEXT,
    "cargoTypeCode" TEXT,
    "capacityCbm" DECIMAL(65,30),
    "weightValue" DECIMAL(65,30),
    "weightUnit" TEXT,
    "packageCount" INTEGER,
    "materialDescription" TEXT,
    "packingType" TEXT,
    "materialValue" DECIMAL(65,30),
    "hsnCode" TEXT,
    "freightType" TEXT,
    "paymentMode" TEXT,
    "pickupAt" TIMESTAMP(3),
    "deliveryAt" TIMESTAMP(3),
    "specialInstructions" TEXT,
    "consignorName" TEXT,
    "consignorCity" TEXT,
    "consignorState" TEXT,
    "consignorPincode" TEXT,
    "consignorAddress" TEXT,
    "consignorContact" TEXT,
    "consignorPhone" TEXT,
    "consigneeName" TEXT,
    "consigneeCity" TEXT,
    "consigneeState" TEXT,
    "consigneePincode" TEXT,
    "consigneeAddress" TEXT,
    "consigneeContact" TEXT,
    "consigneePhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'PORTAL',
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indent" (
    "id" TEXT NOT NULL,
    "indentNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requirementId" TEXT,
    "indentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdById" TEXT,
    "remarks" TEXT,
    "advanceStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "advanceRequested" DECIMAL(65,30),
    "advanceApproved" DECIMAL(65,30),
    "releasedAt" TIMESTAMP(3),
    "vendorId" TEXT,
    "allocatedQuoteId" TEXT,
    "vendorAllocatedAt" TIMESTAMP(3),
    "placementStatus" TEXT NOT NULL DEFAULT 'PLACEMENT_PENDING',
    "placementDeadlineAt" TIMESTAMP(3),
    "vehicleId" TEXT,
    "driverId" TEXT,
    "podReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndentConsignment" (
    "indentId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "vehicleTypeCode" TEXT NOT NULL,
    "bodyTypeCode" TEXT,
    "vehicleQuantity" INTEGER NOT NULL DEFAULT 1,
    "insuranceType" TEXT NOT NULL DEFAULT 'NONE',
    "cargoTypeCode" TEXT NOT NULL,
    "weightValue" DECIMAL(65,30),
    "weightUnit" TEXT NOT NULL DEFAULT 'MT',
    "packageCount" INTEGER,
    "capacityCbm" DECIMAL(65,30),
    "pickupAt" TIMESTAMP(3),
    "deliveryAt" TIMESTAMP(3),
    "podDueAt" TIMESTAMP(3),
    "ewayBillRequired" BOOLEAN NOT NULL DEFAULT false,
    "specialInstructions" TEXT,

    CONSTRAINT "IndentConsignment_pkey" PRIMARY KEY ("indentId")
);

-- CreateTable
CREATE TABLE "IndentLoadingLocation" (
    "indentId" TEXT NOT NULL,
    "partyName" TEXT,
    "gstin" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "addressId" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT DEFAULT 'India',
    "scheduledAt" TIMESTAMP(3),
    "instructions" TEXT,

    CONSTRAINT "IndentLoadingLocation_pkey" PRIMARY KEY ("indentId")
);

-- CreateTable
CREATE TABLE "IndentUnloadingLocation" (
    "indentId" TEXT NOT NULL,
    "partyName" TEXT,
    "gstin" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "addressId" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT DEFAULT 'India',
    "scheduledAt" TIMESTAMP(3),
    "instructions" TEXT,

    CONSTRAINT "IndentUnloadingLocation_pkey" PRIMARY KEY ("indentId")
);

-- CreateTable
CREATE TABLE "IndentCargo" (
    "indentId" TEXT NOT NULL,
    "description" TEXT,
    "packingType" TEXT,
    "hsnCode" TEXT,
    "declaredValue" DECIMAL(65,30),
    "invoiceNumber" TEXT,
    "invoiceValue" DECIMAL(65,30),

    CONSTRAINT "IndentCargo_pkey" PRIMARY KEY ("indentId")
);

-- CreateTable
CREATE TABLE "IndentClientFreight" (
    "indentId" TEXT NOT NULL,
    "clientRate" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "freightType" TEXT,
    "paymentMode" TEXT,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "gstRate" DECIMAL(65,30),

    CONSTRAINT "IndentClientFreight_pkey" PRIMARY KEY ("indentId")
);

-- CreateTable
CREATE TABLE "IndentLine" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "vehicleTypeCode" TEXT,
    "bodyTypeCode" TEXT,
    "tripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorQuote" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "indentLineId" TEXT,
    "vehicleId" TEXT,
    "quotedRate" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndentAllocation" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "indentLineId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorRate" DECIMAL(65,30) NOT NULL,
    "acceptedQuoteId" TEXT,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "reallocatedAt" TIMESTAMP(3),
    "reallocationReason" TEXT,
    "allocatedById" TEXT,

    CONSTRAINT "IndentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndentPayment" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "mode" TEXT,
    "referenceNo" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndentPod" (
    "id" TEXT NOT NULL,
    "indentId" TEXT NOT NULL,
    "fileId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'DRIVER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "IndentPod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportantEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "indentId" TEXT,
    "relatedEntityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportantEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "lrNumber" TEXT NOT NULL,
    "indentId" TEXT,
    "clientId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "routeFrom" TEXT NOT NULL,
    "routeTo" TEXT NOT NULL,
    "cargoSummary" TEXT,
    "loadingWeight" DECIMAL(65,30),
    "clientRate" DECIMAL(65,30) NOT NULL,
    "vendorRate" DECIMAL(65,30) NOT NULL,
    "margin" DECIMAL(65,30) NOT NULL,
    "trackingMode" TEXT DEFAULT 'GPS',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "podReceivedAt" TIMESTAMP(3),
    "driverArrivedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingPing" (
    "id" TEXT NOT NULL,
    "indentId" TEXT,
    "tripId" TEXT,
    "driverId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'GPS',
    "accuracyMeters" DOUBLE PRECISION,
    "provider" TEXT,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subTotal" DECIMAL(65,30) NOT NULL,
    "gstAmount" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "gstRate" DECIMAL(65,30),
    "gstAmount" DECIMAL(65,30),

    CONSTRAINT "ClientInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "advanceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tdsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentMode" TEXT,
    "referenceNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "driverId" TEXT,
    "tripId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "isAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "tripId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdSequence" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IdSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "Address"("city");

-- CreateIndex
CREATE INDEX "OnboardingCase_status_idx" ON "OnboardingCase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_entityType_entityId_key" ON "OnboardingCase"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "StoredFile_storageKey_idx" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "DocumentAttachment_entityType_entityId_idx" ON "DocumentAttachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DocumentAttachment_fileId_idx" ON "DocumentAttachment"("fileId");

-- CreateIndex
CREATE INDEX "LookupCatalog_category_isActive_idx" ON "LookupCatalog"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LookupCatalog_category_code_key" ON "LookupCatalog"("category", "code");

-- CreateIndex
CREATE INDEX "Client_isActive_idx" ON "Client"("isActive");

-- CreateIndex
CREATE INDEX "Client_gstin_idx" ON "Client"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAddress_clientId_type_addressId_key" ON "ClientAddress"("clientId", "type", "addressId");

-- CreateIndex
CREATE INDEX "Vendor_isActive_idx" ON "Vendor"("isActive");

-- CreateIndex
CREATE INDEX "VendorAddress_vendorId_idx" ON "VendorAddress"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_dlNumber_key" ON "Driver"("dlNumber");

-- CreateIndex
CREATE INDEX "Driver_phone_idx" ON "Driver"("phone");

-- CreateIndex
CREATE INDEX "Driver_city_idx" ON "Driver"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "Vehicle_vendorId_idx" ON "Vehicle"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_reqNumber_key" ON "Requirement"("reqNumber");

-- CreateIndex
CREATE INDEX "Requirement_clientId_status_idx" ON "Requirement"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Indent_indentNumber_key" ON "Indent"("indentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Indent_requirementId_key" ON "Indent"("requirementId");

-- CreateIndex
CREATE INDEX "Indent_clientId_status_idx" ON "Indent"("clientId", "status");

-- CreateIndex
CREATE INDEX "Indent_status_idx" ON "Indent"("status");

-- CreateIndex
CREATE INDEX "Indent_vendorId_idx" ON "Indent"("vendorId");

-- CreateIndex
CREATE INDEX "Indent_indentDate_idx" ON "Indent"("indentDate");

-- CreateIndex
CREATE UNIQUE INDEX "IndentLine_tripId_key" ON "IndentLine"("tripId");

-- CreateIndex
CREATE INDEX "IndentLine_indentId_idx" ON "IndentLine"("indentId");

-- CreateIndex
CREATE UNIQUE INDEX "IndentLine_indentId_lineNumber_key" ON "IndentLine"("indentId", "lineNumber");

-- CreateIndex
CREATE INDEX "VendorQuote_indentId_status_idx" ON "VendorQuote"("indentId", "status");

-- CreateIndex
CREATE INDEX "VendorQuote_indentId_quotedRate_idx" ON "VendorQuote"("indentId", "quotedRate");

-- CreateIndex
CREATE INDEX "VendorQuote_vendorId_idx" ON "VendorQuote"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorQuote_indentId_vendorId_key" ON "VendorQuote"("indentId", "vendorId");

-- CreateIndex
CREATE INDEX "IndentAllocation_indentId_idx" ON "IndentAllocation"("indentId");

-- CreateIndex
CREATE INDEX "IndentAllocation_indentId_status_idx" ON "IndentAllocation"("indentId", "status");

-- CreateIndex
CREATE INDEX "IndentAllocation_vendorId_idx" ON "IndentAllocation"("vendorId");

-- CreateIndex
CREATE INDEX "IndentAllocation_indentLineId_idx" ON "IndentAllocation"("indentLineId");

-- CreateIndex
CREATE INDEX "IndentPayment_indentId_idx" ON "IndentPayment"("indentId");

-- CreateIndex
CREATE INDEX "IndentPod_indentId_idx" ON "IndentPod"("indentId");

-- CreateIndex
CREATE INDEX "ImportantEvent_status_idx" ON "ImportantEvent"("status");

-- CreateIndex
CREATE INDEX "ImportantEvent_severity_idx" ON "ImportantEvent"("severity");

-- CreateIndex
CREATE INDEX "ImportantEvent_createdAt_idx" ON "ImportantEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ImportantEvent_indentId_idx" ON "ImportantEvent"("indentId");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_lrNumber_key" ON "Trip"("lrNumber");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "Trip_clientId_idx" ON "Trip"("clientId");

-- CreateIndex
CREATE INDEX "Trip_vendorId_idx" ON "Trip"("vendorId");

-- CreateIndex
CREATE INDEX "Trip_driverId_idx" ON "Trip"("driverId");

-- CreateIndex
CREATE INDEX "Trip_indentId_idx" ON "Trip"("indentId");

-- CreateIndex
CREATE INDEX "TrackingPing_indentId_recordedAt_idx" ON "TrackingPing"("indentId", "recordedAt");

-- CreateIndex
CREATE INDEX "TrackingPing_tripId_recordedAt_idx" ON "TrackingPing"("tripId", "recordedAt");

-- CreateIndex
CREATE INDEX "TrackingPing_driverId_idx" ON "TrackingPing"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_invoiceNumber_key" ON "ClientInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "ClientInvoice_clientId_status_idx" ON "ClientInvoice"("clientId", "status");

-- CreateIndex
CREATE INDEX "ClientInvoiceLine_tripId_idx" ON "ClientInvoiceLine"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoiceLine_invoiceId_tripId_key" ON "ClientInvoiceLine"("invoiceId", "tripId");

-- CreateIndex
CREATE INDEX "VendorPayment_vendorId_status_idx" ON "VendorPayment"("vendorId", "status");

-- CreateIndex
CREATE INDEX "VendorPayment_tripId_idx" ON "VendorPayment"("tripId");

-- CreateIndex
CREATE INDEX "Advance_tripId_idx" ON "Advance"("tripId");

-- CreateIndex
CREATE INDEX "Advance_vendorId_idx" ON "Advance"("vendorId");

-- CreateIndex
CREATE INDEX "Advance_driverId_idx" ON "Advance"("driverId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdSequence_prefix_year_key" ON "IdSequence"("prefix", "year");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAttachment" ADD CONSTRAINT "DocumentAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommercial" ADD CONSTRAINT "ClientCommercial_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommercial" ADD CONSTRAINT "ClientCommercial_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorAddress" ADD CONSTRAINT "VendorAddress_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorAddress" ADD CONSTRAINT "VendorAddress_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCommercial" ADD CONSTRAINT "VendorCommercial_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCommercial" ADD CONSTRAINT "VendorCommercial_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCompliance" ADD CONSTRAINT "VehicleCompliance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCompliance" ADD CONSTRAINT "VehicleCompliance_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTelematics" ADD CONSTRAINT "VehicleTelematics_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indent" ADD CONSTRAINT "Indent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indent" ADD CONSTRAINT "Indent_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indent" ADD CONSTRAINT "Indent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indent" ADD CONSTRAINT "Indent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indent" ADD CONSTRAINT "Indent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indent" ADD CONSTRAINT "Indent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentConsignment" ADD CONSTRAINT "IndentConsignment_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLoadingLocation" ADD CONSTRAINT "IndentLoadingLocation_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLoadingLocation" ADD CONSTRAINT "IndentLoadingLocation_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentUnloadingLocation" ADD CONSTRAINT "IndentUnloadingLocation_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentUnloadingLocation" ADD CONSTRAINT "IndentUnloadingLocation_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentCargo" ADD CONSTRAINT "IndentCargo_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentClientFreight" ADD CONSTRAINT "IndentClientFreight_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLine" ADD CONSTRAINT "IndentLine_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentLine" ADD CONSTRAINT "IndentLine_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorQuote" ADD CONSTRAINT "VendorQuote_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorQuote" ADD CONSTRAINT "VendorQuote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorQuote" ADD CONSTRAINT "VendorQuote_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentAllocation" ADD CONSTRAINT "IndentAllocation_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentAllocation" ADD CONSTRAINT "IndentAllocation_indentLineId_fkey" FOREIGN KEY ("indentLineId") REFERENCES "IndentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentAllocation" ADD CONSTRAINT "IndentAllocation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentAllocation" ADD CONSTRAINT "IndentAllocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentAllocation" ADD CONSTRAINT "IndentAllocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentAllocation" ADD CONSTRAINT "IndentAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentPayment" ADD CONSTRAINT "IndentPayment_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentPayment" ADD CONSTRAINT "IndentPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentPod" ADD CONSTRAINT "IndentPod_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentPod" ADD CONSTRAINT "IndentPod_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndentPod" ADD CONSTRAINT "IndentPod_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantEvent" ADD CONSTRAINT "ImportantEvent_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantEvent" ADD CONSTRAINT "ImportantEvent_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantEvent" ADD CONSTRAINT "ImportantEvent_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingPing" ADD CONSTRAINT "TrackingPing_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "Indent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingPing" ADD CONSTRAINT "TrackingPing_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingPing" ADD CONSTRAINT "TrackingPing_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoiceLine" ADD CONSTRAINT "ClientInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoiceLine" ADD CONSTRAINT "ClientInvoiceLine_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

