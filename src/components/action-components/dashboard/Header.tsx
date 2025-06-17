"use client";

interface DashboardHeaderProps {
  title: string;
  rightContent?: React.ReactNode;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  rightContent,
}: DashboardHeaderProps) => {
  return (
    <div className="flex justify-between mt-6 mb-9">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div>{rightContent}</div>
    </div>
  );
};

export default DashboardHeader;
