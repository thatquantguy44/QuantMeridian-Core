import { forwardRef } from "react";
import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router-dom";

/**
 * Drop-in replacement for `next/link`. Keeps the `href` prop the rest of the
 * codebase uses while delegating to react-router's `Link` (`to`). External and
 * hash links fall back to a plain anchor so absolute URLs keep working.
 */
export type LinkProps = Omit<RouterLinkProps, "to"> & { href: string };

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, children, ...rest }, ref) {
  const isExternal = /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
  if (isExternal) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <RouterLink ref={ref} to={href} {...rest}>
      {children}
    </RouterLink>
  );
});

export default Link;
