import { ErrorExperience } from "./error-experience";

export default function NotFound() {
  return (
    <ErrorExperience
      code="404"
      eyebrow="That invitation is not here"
      title="We could not find this page"
      message="The link may be old, incomplete, or moved. Go back and try another path."
    />
  );
}
