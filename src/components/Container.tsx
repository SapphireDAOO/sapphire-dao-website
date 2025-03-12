import { cn } from "@/lib/utils";

// Define the props for the Container component
// Extends React's `ComponentProps` for a <div> element and adds a custom `isFullWidth` prop
interface ContainerProps extends React.ComponentProps<"div"> {
  isFullWidth?: boolean; // Optional prop to indicate if the container should span full width
}

// Container component definition
// Provides a styled wrapper with optional additional classes and other div props
const Container = ({ children, className, ...props }: ContainerProps) => {
  return (
    // Render a <div> element
    // Spread the remaining props (e.g., onClick, id, etc.) onto the div
    // Use the `cn` utility to combine default classes with any additional classes passed via `className`
    <div {...props} className={cn("max-w-5xl mx-auto px-5", className)}>
      {children}
    </div>
  );
};

export default Container;
