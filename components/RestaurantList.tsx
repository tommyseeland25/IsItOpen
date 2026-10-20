import type { Restaurant } from "../lib/types";
import { RestaurantCard } from "./RestaurantCard";

export function RestaurantList({ restaurants, now }: { restaurants: Restaurant[]; now: number }) {
  return (
    <ul className="space-y-3">
      {restaurants.map((r) => (
        <RestaurantCard key={r.id} restaurant={r} now={now} />
      ))}
    </ul>
  );
}
