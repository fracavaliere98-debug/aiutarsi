-- Create volunteer_reviews table for NPO -> Volunteer reviews
CREATE TABLE volunteer_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  npo_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_present BOOLEAN NOT NULL DEFAULT true,
  stars INTEGER CHECK (stars >= 1 AND stars <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent multiple reviews by the same NPO for the same volunteer on the same activity
  UNIQUE(activity_id, npo_id, volunteer_id)
);

-- Enable Row Level Security
ALTER TABLE volunteer_reviews ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can read volunteer reviews
CREATE POLICY "Volunteer reviews are visible to everyone" 
ON volunteer_reviews FOR SELECT 
USING (true);

-- Only NPOs can insert reviews for their activities
CREATE POLICY "NPOs can insert volunteer reviews" 
ON volunteer_reviews FOR INSERT 
WITH CHECK (auth.uid() = npo_id);

-- Only NPOs can update their own reviews
CREATE POLICY "NPOs can update their volunteer reviews" 
ON volunteer_reviews FOR UPDATE
USING (auth.uid() = npo_id);

-- Optional: Allow NPOs to delete their reviews
CREATE POLICY "NPOs can delete their volunteer reviews" 
ON volunteer_reviews FOR DELETE 
USING (auth.uid() = npo_id);
