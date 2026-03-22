"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type CommentData = {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string | null; avatarUrl: string | null };
  replies: CommentData[];
};

type Props = {
  eventId?: string;
  buildingId?: string;
};

export function CommentSection({ eventId, buildingId }: Props) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [posting, setPosting] = useState(false);

  const supabase = createSupabaseBrowser();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchComments = useCallback(async () => {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (buildingId) params.set("buildingId", buildingId);
    const res = await fetch(`/api/comments?${params}`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments);
    }
  }, [eventId, buildingId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePost = async (parentId?: string) => {
    const content = parentId ? replyText : newComment;
    if (!content.trim()) return;
    setPosting(true);

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.trim(),
        eventId,
        buildingId,
        parentId,
      }),
    });

    if (res.ok) {
      if (parentId) {
        setReplyText("");
        setReplyingTo(null);
      } else {
        setNewComment("");
      }
      await fetchComments();
    }
    setPosting(false);
  };

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const totalCount = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <div className="comment-section">
      <h4 className="comment-section-title">Comments ({totalCount})</h4>

      {user ? (
        <div className="comment-input-row">
          <input
            className="comment-input"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            maxLength={1000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePost();
              }
            }}
          />
          <button
            className="comment-post-btn"
            onClick={() => handlePost()}
            disabled={posting || !newComment.trim()}
          >
            Post
          </button>
        </div>
      ) : (
        <button className="comment-sign-in" onClick={handleSignIn}>
          Sign in to comment
        </button>
      )}

      <div className="comment-list">
        {comments.map((c) => (
          <div key={c.id} className="comment-thread">
            <div className="comment-item">
              <div className="comment-meta">
                <strong>{c.author.name ?? "Anonymous"}</strong>
                <span className="comment-time">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="comment-content">{c.content}</p>
              {user && (
                <button
                  className="comment-reply-btn"
                  onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                >
                  Reply
                </button>
              )}
            </div>

            {c.replies.map((r) => (
              <div key={r.id} className="comment-item comment-reply">
                <div className="comment-meta">
                  <strong>{r.author.name ?? "Anonymous"}</strong>
                  <span className="comment-time">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="comment-content">{r.content}</p>
              </div>
            ))}

            {replyingTo === c.id && (
              <div className="comment-input-row comment-reply-input">
                <input
                  className="comment-input"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply..."
                  maxLength={1000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handlePost(c.id);
                    }
                  }}
                  autoFocus
                />
                <button
                  className="comment-post-btn"
                  onClick={() => handlePost(c.id)}
                  disabled={posting || !replyText.trim()}
                >
                  Reply
                </button>
              </div>
            )}
          </div>
        ))}

        {comments.length === 0 && (
          <p className="comment-empty">No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}
