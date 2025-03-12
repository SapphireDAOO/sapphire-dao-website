import { Book, Github } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "./ui/button";

const HeroSection = () => {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl sm:text-6xl font-bold mb-6">
          Welcome to Sapphire DAO
        </h1>
        <p className="text-lg sm:text-2xl mb-8">
        Sapphire DAO is a platform on the polygon blockchain used for paying for
          goods and services. <br />
          This payment system makes use of cryptocurrency as a medium of
          transaction; <br />
          specifically, it uses POL(matic) on the polygon blockchain
        </p>

        <div className="flex justify-center gap-8">
          <Link
            href="https://github.com/SapphireDAOO"
            className={buttonVariants({ variant: "outline" })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Github <Github />
          </Link>

          <Link
            href="https://sapphiredao.gitbook.io/sapphire"
            className={buttonVariants({ variant: "default" })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation <Book />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
