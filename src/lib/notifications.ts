import { prisma } from "./prisma";
import { notificationMessage } from "./logic";

export async function notifyClientOfTripStatus(tripId: string, status: string) {
  const message = notificationMessage(status);
  if (!message) return;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { client: { select: { name: true, phone: true } } },
  });
  if (!trip) return;

  await prisma.notification.create({
    data: {
      channel: "WHATSAPP",
      to: trip.client.phone ?? "unknown",
      subject: `Trip ${status.replace(/_/g, " ")}`,
      body: `Dear ${trip.client.name}, your shipment ${trip.lrNumber} (${trip.routeFrom} - ${trip.routeTo}) ${message}.`,
      tripId,
      entityType: "TRIP",
      entityId: tripId,
      status: "PENDING",
    },
  });
}
