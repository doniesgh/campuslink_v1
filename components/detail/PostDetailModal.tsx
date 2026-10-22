"use client";
import Modal, { ModalHeader } from '../ui/Modal';
import Alert from '../ui/Alert';
import TypeBadge from '../common/TypeBadge';
import TagList from '../common/TagList';
import PostHeader from './PostHeader';
import PostGallery from './PostGallery';
import PostFacts from './PostFacts';
import OwnerStatusControl from './OwnerStatusControl';
import CommentSection from './CommentSection';
import { usePostDetail } from '../../hooks/usePostDetail';

interface Props {
  postId: string;
  currentUserId: string;
  onClose: () => void;
  onChanged?: () => void;
}

export default function PostDetailModal({ postId, currentUserId, onClose, onChanged }: Props) {
  const { post, error, isOwner, comments, addComment, deleteComment, changeStatus } =
    usePostDetail(postId, currentUserId, onChanged);

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>{post && <TypeBadge type={post.type} />}</ModalHeader>

      {error && <Alert>{error}</Alert>}
      {!post && !error && <p className="text-sm text-slate-500">Loading…</p>}

      {post && (
        <div className="grid gap-4">
          <PostHeader post={post} />
          <PostGallery images={post.images} />
          <p className="whitespace-pre-wrap leading-relaxed">{post.description}</p>
          <PostFacts post={post} />
          <TagList tags={post.tags} />

          {isOwner && <OwnerStatusControl status={post.status} onChange={changeStatus} />}

          <hr className="border-slate-200 dark:border-slate-800" />

          <CommentSection
            comments={comments}
            currentUserId={currentUserId}
            onAdd={addComment}
            onDelete={deleteComment}
          />
        </div>
      )}
    </Modal>
  );
}
