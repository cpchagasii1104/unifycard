BEGIN;

CREATE TABLE IF NOT EXISTS public_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  slug TEXT,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  profile_type TEXT NOT NULL DEFAULT 'user'
    CHECK (profile_type IN ('user','page','group','cultural_profile')),
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','private','followers_only')),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_public_profiles_actor UNIQUE (tenant_id, actor_id),
  CONSTRAINT uq_public_profiles_slug UNIQUE (tenant_id, slug)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_public_profiles_actor ON public_profiles(actor_id);
CREATE INDEX IF NOT EXISTS idx_public_profiles_slug ON public_profiles(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_public_profiles_type ON public_profiles(profile_type);

COMMIT;