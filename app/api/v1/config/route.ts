import { json } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { cities } from "@/lib/config/site";
import { DISPATCH, MAX_SEARCH_SECONDS } from "@/lib/domain/dispatch";
import { ENABLED_PAYMENT_METHODS } from "@/lib/domain/ride";
import { placesProvider } from "@/lib/services/places";
import { getPricing } from "@/lib/services/pricing";

/**
 * Everything an app needs before anyone signs in: where the service runs, what
 * a ride costs and how long a search lasts. Public on purpose — the website
 * shows the same numbers.
 */
export const GET = apiRoute(async () => {
  const { values, updatedAt } = await getPricing();

  return json({
    currency: values.currency,
    paymentMethods: ENABLED_PAYMENT_METHODS,
    pricing: {
      baseFare: values.baseFare,
      perKm: values.perKm,
      perMinute: values.perMinute,
      minimumFare: values.minimumFare,
      bookingFee: values.bookingFee,
      cancellationFee: values.cancellationFee,
      updatedAt,
    },
    /** Which geocoder is answering /geo/* — "google" or "osm". */
    places: placesProvider(),
    search: {
      radiusKm: DISPATCH.radiusKm,
      offerSeconds: DISPATCH.offerSeconds,
      maxSeconds: MAX_SEARCH_SECONDS,
    },
    cities: cities.map((city) => ({
      id: city.id,
      name: city.name,
      center: city.center,
      radiusKm: city.radiusKm,
      bookable: city.launch === "launching",
    })),
  });
});
