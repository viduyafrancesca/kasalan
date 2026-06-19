export type GuestRsvpLike = {
  rsvp_status: string;
  plus_one: boolean;
};

export function countAttendingPlusOnes(guests: GuestRsvpLike[]): number {
  return guests.filter((g) => g.rsvp_status === "attending" && g.plus_one).length;
}
