-- Friends table: tracks friend relationships and pending requests.
-- friend_1 is always the requester, friend_2 is the target.
-- status: 'pending' means friend_1 sent a request; 'friend' means both parties accepted.

CREATE TABLE IF NOT EXISTS public.friends (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  friend_1   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_2   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text        NOT NULL CHECK (status IN ('pending', 'friend')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_friend    CHECK (friend_1 <> friend_2),
  CONSTRAINT friends_unique    UNIQUE (friend_1, friend_2)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friends_select" ON public.friends;
DROP POLICY IF EXISTS "friends_insert" ON public.friends;
DROP POLICY IF EXISTS "friends_update" ON public.friends;
DROP POLICY IF EXISTS "friends_delete" ON public.friends;

-- Both parties can see their own friendship rows.
CREATE POLICY "friends_select"
  ON public.friends FOR SELECT TO authenticated
  USING (friend_1 = auth.uid() OR friend_2 = auth.uid());

-- Only the requester (friend_1) can insert; prevents sending when a reverse pending exists.
CREATE POLICY "friends_insert"
  ON public.friends FOR INSERT TO authenticated
  WITH CHECK (
    friend_1 = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.friends existing
      WHERE existing.friend_1 = friends.friend_2
        AND existing.friend_2 = auth.uid()
    )
  );

-- Only friend_2 can update (to accept the request).
CREATE POLICY "friends_update"
  ON public.friends FOR UPDATE TO authenticated
  USING  (friend_2 = auth.uid())
  WITH CHECK (friend_2 = auth.uid());

-- Either party can delete (remove friend or decline request).
CREATE POLICY "friends_delete"
  ON public.friends FOR DELETE TO authenticated
  USING (friend_1 = auth.uid() OR friend_2 = auth.uid());
