// export type PostType = "covoiturage" | "objet_perdu" | "experience" | "idee";
// export type PostStatus = "active" | "closed" | "resolved";
// export type LostKind = "perdu" | "trouve";

// export const TYPES: PostType[] = ["covoiturage", "objet_perdu", "experience", "idee"];
// export const STATUSES: PostStatus[] = ["active", "closed", "resolved"];

// export interface Author {
//   _id: string;
//   firstname: string;
//   lastname: string;

//   avatar?: string;
// }

// export interface CarpoolInfo {
//   departure?: string;
//   destination?: string;
//   departureDate?: string;
//   seats?: number;
//   price?: number;
//   departureCoords?: { lat: number; lng: number };
//   destinationCoords?: { lat: number; lng: number };
//   distanceKm?: number;
//   durationMin?: number;
//   preferences?: string[];
//   flexibleStops?: boolean;
// }

// export interface LostInfo {
//   kind?: LostKind;
//   category?: string;
//   place?: string;
//   date?: string;
// }

// export interface Post {
//   _id: string;
//   author: Author | string;
//   type: PostType;
//   title: string;
//   description: string;
//   tags: string[];
//   location?: string;
//   images?: string[];
//   covoiturage?: CarpoolInfo;
//   objetPerdu?: LostInfo;
//   status: PostStatus;
//   likesCount: number;
//   commentsCount: number;
//   views: number;
//   likedByMe?: boolean;
//   likes?: string[];
//   createdAt: string;
// }

// export interface PostsPage {
//   posts: Post[];
//   page: number;
//   pages: number;
//   total: number;
// }

// export interface PostComment {
//   _id: string;
//   post: string;
//   author: Author;
//   content: string;
//   parent: string | null;
//   createdAt: string;
//   updatedAt?: string;
// }
export type PostType = "covoiturage" | "objet_perdu" | "experience" | "idee";
export type PostStatus = "active" | "closed" | "resolved";
export type LostKind = "perdu" | "trouve";

export const TYPES: PostType[] = ["covoiturage", "objet_perdu", "experience", "idee"];
export const STATUSES: PostStatus[] = ["active", "closed", "resolved"];

export interface Author {
  _id: string;
  firstname: string;
  lastname: string;

  avatar?: string;
}

export interface CarpoolInfo {
  departure?: string;
  destination?: string;
  departureDate?: string;
  seats?: number;
  price?: number;
  departureCoords?: { lat: number; lng: number };
  destinationCoords?: { lat: number; lng: number };
  distanceKm?: number;
  durationMin?: number;
  preferences?: string[];
  flexibleStops?: boolean;
}

export interface LostInfo {
  kind?: LostKind;
  category?: string;
  place?: string;
  date?: string;
}

export interface Post {
  _id: string;
  author: Author | string;
  type: PostType;
  title: string;
  description: string;
  tags: string[];
  location?: string;
  images?: string[];
  covoiturage?: CarpoolInfo;
  objetPerdu?: LostInfo;
  status: PostStatus;
  likesCount: number;
  commentsCount: number;
  views: number;
  likedByMe?: boolean;
  likes?: string[];
  createdAt: string;
}

export interface PostsPage {
  posts: Post[];
  page: number;
  pages: number;
  total: number;
}

export interface PostComment {
  _id: string;
  post: string;
  author: Author;
  content: string;
  parent: string | null;
  createdAt: string;
  updatedAt?: string;
}

/** Réponse de GET /posts/nearby : un covoiturage + distance (km) entre la recherche et son départ. */
export type NearbyRide = Post & { awayKm: number; distanceM?: number };

/** Réponse de GET /posts/:id/matches. */
export interface PostMatch {
  post: Post;
  score: number;
  reasons: string[];
  /** true quand l'IA a analysé ce candidat. */
  ai?: boolean;
  aiReason?: string;
}

/** Covoiturage compatible (GET /posts/:id/compatible). */
export interface CompatibleRide {
  post: Post;
  score: number;
  departureKm: number;
  arrivalKm: number;
  minutesApart: number;
}

export type ReservationStatus = "pending" | "accepted" | "rejected" | "cancelled";

/** Demande de places sur un covoiturage (GET /posts/:id/reservations). */
export interface Reservation {
  _id: string;
  post: string;
  passenger: { _id: string; firstname?: string; lastname?: string } | string;
  seats: number;
  message?: string;
  status: ReservationStatus;
  createdAt: string;
}
