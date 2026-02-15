import { ExternalLink, BookOpen, Github } from "lucide-react";

interface EndpointLinksProps {
  links: {
    endpoint: string;
    docs?: string;
    repo?: string;
  };
}

export function EndpointLinks({ links }: EndpointLinksProps) {
  const items: Array<{
    href: string;
    label: string;
    icon: React.ReactNode;
  }> = [];

  items.push({
    href: links.endpoint,
    label: "Open endpoint",
    icon: <ExternalLink className="h-4 w-4" />,
  });

  if (links.docs) {
    items.push({
      href: links.docs,
      label: "View documentation",
      icon: <BookOpen className="h-4 w-4" />,
    });
  }

  if (links.repo) {
    items.push({
      href: links.repo,
      label: "View repository",
      icon: <Github className="h-4 w-4" />,
    });
  }

  return (
    <div className="group inline-flex items-center gap-2">
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition-all duration-200 hover:bg-gray-100 hover:text-text dark:hover:bg-gray-800 dark:hover:text-text-light opacity-70 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
        >
          {item.icon}
          <span className="sr-only">{item.label}</span>
        </a>
      ))}
    </div>
  );
}
