import AuthScreen from "@/components/auth-screen";

export function generateStaticParams() {
  return ["sso-callback", "factor-one", "factor-two", "verify"].map((route) => ({
    "clerk-route": [route],
  }));
}

export const dynamicParams = false;

export default function SignInCallbackPage() {
  return <AuthScreen mode="sign-in" />;
}
