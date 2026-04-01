export type Profile = {
  id: string;
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string | null;
};

export type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  is_active: boolean;
  sort_order: number | null;
};

export type SubcategoryRow = {
  id: string;
  project_id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
};

export type TimeEntryRow = {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  project_id: string;
  subcategory: string | null;
  location: string | null;
};

export type ReportRange = "week" | "month" | "3months" | "12months";
