export interface Profile {
  id: number;
  name: string;
  age: number;
  neighborhood: string;
  childrenAges: string[];
  bio: string;
  interests: string[];
  avatar: string;
  mutual: number;
  distanceMiles: number;
  expecting: boolean;
  userId?: string;
}
