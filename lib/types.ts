export interface DbChild {
  id: string;
  user_id: string;
  age_months: number;
  created_at: string;
}

export interface DbProfile {
  id: string;
  name: string;
  first_name: string;
  last_initial: string;
  bio: string;
  neighborhood: string;
  city: string;
  avatar_url: string;
  parent_type: string;
  interests: string[];
  children_ages: string[];
  postcode_district?: string;
  due_date: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbPost {
  id: string;
  author_id: string;
  post_type: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  profiles?: DbProfile | null;
}

export interface DbPostWithMeta extends DbPost {
  likes_count: number;
  replies_count: number;
  user_liked: boolean;
}

export interface DbListing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price_pence: number;
  condition: string;
  category: string;
  postcode_district: string;
  status: string;
  offers_welcome: boolean;
  created_at: string;
  profiles?: DbProfile | null;
  saved?: boolean;
  image_url?: string;
}

export interface DbConversation {
  id: string;
  user1_id: string;
  user2_id: string;
  about: string;
  last_message: string;
  last_message_at: string;
  created_at: string;
  other_profile?: DbProfile | null;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface DbConnection {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_user?: DbProfile | null;
  to_user?: DbProfile | null;
}
