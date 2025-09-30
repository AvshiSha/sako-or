-- CreateTable
CREATE TABLE "public"."checkouts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerFirstName" TEXT NOT NULL,
    "customerLastName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerStreetName" TEXT NOT NULL,
    "customerStreetNumber" TEXT NOT NULL,
    "customerFloor" TEXT,
    "customerApartment" TEXT,
    "customerCity" TEXT NOT NULL,
    "customerState" TEXT NOT NULL,
    "customerZip" TEXT,
    "customerCountry" TEXT NOT NULL,
    "customerID" TEXT,
    "customerDeliveryNotes" TEXT,

    CONSTRAINT "checkouts_pkey" PRIMARY KEY ("id")
);
