export interface DbProfile {
  id: string;
  name: string;
  bio: string;
  neighborhood: string;
  city: string;
  avatar_url: string;
  parent_stage: string;
  interests: string[];
  children_ages: string[];
  postcode: string;
  postcode_district?: string;
  due_date: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbPost {
  id: string;
  user_id: string;
  type: string;
  content: string;
  tags: string[];
  anonymous: boolean;
  created_at: string;
  profiles?: DbProfile | null;
}

export interface DbPostWithMeta extends DbPost {
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
}

export interface DbListing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  category: string;
  image_url: string;
  sold: boolean;
  created_at: string;
  profiles?: DbProfile | null;
  saved?: boolean;
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
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  requester?: DbProfile | null;
  addressee?: DbProfile | null;
}
