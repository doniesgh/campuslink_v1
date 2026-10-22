import type { Role } from "@/lib/types";

export type PostType = "covoiturage" | "objet_perdu" | "experience" | "idee";
export type PostStatus = "active" | "closed" | "resolved";
export type LostKind = "perdu" | "trouve";

export const TYPES: PostType[] = ["covoiturage", "objet_perdu", "experience", "idee"];
export const STATUSES: PostStatus[] = ["active", "closed", "resolved"];

/** Author of a post or comment as the API sends it (null once the account is deleted). */
export interface Author {
  _id: string;
  firstname: string;
  lastname: string;
}

/** The signed-in user: the author of a post or comment, or an ADMIN, can manage it. */
export interface Viewer {
  id: string;
  role: Role;
}

export interface CarpoolInfo {
  departure?: string;
  destination?: string;
  departureDate?: string;
  seats?: number;
  price?: number;
}

export interface LostInfo {
  kind?: LostKind;
  category?: string;
  place?: string;
  date?: string;
}

export interface Post {
  _id: string;
  author: Author | string | null;
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
  author: Author | null;
  content: string;
  parent: string | null;
  createdAt: string;
}
