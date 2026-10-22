import { request } from './http';
import type {
  CommentListResponse,
  CommentResponse,
  CreatePostPayload,
  LikeResponse,
  PostListParams,
  PostListResponse,
  PostResponse,
  PostStatus,
} from '../types/post';

export const postsApi = {
  list: (params: PostListParams) => request<PostListResponse>('/posts', { params }),
  get: (id: string) => request<PostResponse>(`/posts/${id}`),
  create: (data: CreatePostPayload) =>
    request<PostResponse>('/posts', { method: 'POST', body: data }),
  update: (id: string, data: { status?: PostStatus }) =>
    request<PostResponse>(`/posts/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => request<null>(`/posts/${id}`, { method: 'DELETE' }),
  like: (id: string) => request<LikeResponse>(`/posts/${id}/like`, { method: 'POST' }),

  comments: (id: string) => request<CommentListResponse>(`/posts/${id}/comments`),
  addComment: (id: string, data: { content: string; parent: string | null }) =>
    request<CommentResponse>(`/posts/${id}/comments`, { method: 'POST', body: data }),
  removeComment: (id: string, commentId: string) =>
    request<null>(`/posts/${id}/comments/${commentId}`, { method: 'DELETE' }),
};
