export interface Country {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface CountryInput { name: string; code: string }