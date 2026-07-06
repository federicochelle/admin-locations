CREATE TABLE IF NOT EXISTS public.location_analysis_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,

    provider text NOT NULL,
    model text NOT NULL,

    prompt_version text NOT NULL DEFAULT 'v1',

    status text NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'error')),

    duration_ms integer,

    input_tokens integer,
    output_tokens integer,
    total_tokens integer,

    estimated_cost_usd numeric(10,6),

    description_applied boolean DEFAULT false,
    features_applied boolean DEFAULT false,
    tags_applied boolean DEFAULT false,

    error_code text,
    error_message text,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_analysis_runs_location
ON public.location_analysis_runs(location_id);

CREATE INDEX IF NOT EXISTS idx_location_analysis_runs_created_at
ON public.location_analysis_runs(created_at DESC);
