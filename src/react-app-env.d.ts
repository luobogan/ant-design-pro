declare module '@umijs/max' {
  export const useNavigate: typeof import('react-router-dom').useNavigate;
  export const useSearchParams: typeof import('react-router-dom').useSearchParams;
  export const useParams: typeof import('react-router-dom').useParams;
  export const history: {
    push: (path: string) => void;
    replace: (path: string) => void;
    go: (delta: number) => void;
    goBack: () => void;
    goForward: () => void;
  };
}
