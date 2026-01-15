import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Gamepad2, Trophy, Hash, Brain, Sparkles, Flame, Lightbulb, Menu, MessageSquare, GitBranch, UserPlus, Send, Loader2 } from "lucide-react";
import FloatingBackground from "@/components/ui/FloatingBackground";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import tournamentBracket from "@/assets/tournament-bracket.png";

export type Difficulty = "easy" | "medium" | "hard";

interface LandingPageProps {
  onPlayComputer: (difficulty: Difficulty) => void;
  onCreateTournament: () => void;
  onJoinTournament: () => void;
}

export default function LandingPage({ onPlayComputer, onCreateTournament, onJoinTournament }: LandingPageProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("medium");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showSeedingRules, setShowSeedingRules] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const { toast } = useToast();
  
  const difficulties: { key: Difficulty; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "easy", label: "Easy", icon: <Sparkles className="w-4 h-4" />, color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30" },
    { key: "medium", label: "Medium", icon: <Brain className="w-4 h-4" />, color: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    { key: "hard", label: "Hard", icon: <Flame className="w-4 h-4" />, color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30" },
  ];

  const handleSendFeedback = async () => {
    if (!feedbackName.trim() || !feedbackMessage.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter your name and message.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingFeedback(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-feedback", {
        body: {
          name: feedbackName.trim(),
          email: feedbackEmail.trim(),
          message: feedbackMessage.trim(),
        },
      });

      if (error) throw error;

      toast({
        title: "Feedback sent! 🎉",
        description: "Thank you for your feedback. We appreciate it!",
      });

      setFeedbackName("");
      setFeedbackEmail("");
      setFeedbackMessage("");
      setShowFeedback(false);
    } catch (error: any) {
      console.error("Error sending feedback:", error);
      toast({
        title: "Failed to send feedback",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <FloatingBackground />
      
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="container max-w-lg mx-auto flex items-center justify-between">
          {/* How It Works - Left */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowHowItWorks(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors"
          >
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium">How it Works</span>
          </motion.button>

          {/* Menu Dropdown - Right */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors">
                  <Menu className="w-5 h-5" />
                  <span className="text-sm font-medium">Menu</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuItem onClick={() => setShowSeedingRules(true)} className="cursor-pointer">
                  <GitBranch className="w-4 h-4 mr-2" />
                  Seeding Rules
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowFeedback(true)} className="cursor-pointer">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Feedback
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        </div>
      </div>

      {/* How It Works Sheet */}
      <Sheet open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-500" />
              How TicTacToe Works
            </SheetTitle>
            <SheetDescription>
              Learn the unique bidding mechanics of our game
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                💰 Starting Balance
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Each player starts with <span className="font-bold text-foreground">$100</span>. This is your ammunition for the entire game!
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                🎯 Bidding System
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Before each move, both players place a <span className="font-bold text-foreground">secret bid</span>. The higher bidder wins the right to place their mark. <span className="text-destructive font-medium">Both players lose their bid amount</span>, win or lose!
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                ⏱️ Time Limits
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                You have <span className="font-bold text-foreground">20 seconds</span> to place your bid each round, and another <span className="font-bold text-foreground">20 seconds</span> to make your move if you win the bid. If time runs out, the system handles it for you.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                🏆 Winning Conditions
              </h3>
              <ul className="text-muted-foreground text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">Standard Win:</span>
                  <span>Get three marks in a row (horizontal, vertical, or diagonal)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">Economic Win:</span>
                  <span>Have more money when the board fills up</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">Bankruptcy:</span>
                  <span>Your opponent runs out of money</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                🎮 Best of 3
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Matches are played in a <span className="font-bold text-foreground">best of 3 format</span>. First player to win 2 rounds takes the match!
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Seeding Rules Sheet */}
      <Sheet open={showSeedingRules} onOpenChange={setShowSeedingRules}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-primary" />
              Seeding Rules
            </SheetTitle>
            <SheetDescription>
              How players are seeded in tournaments
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">👥 Unlimited Players</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Any number of players can join a tournament! The bracket automatically adjusts to accommodate all participants. For example, a tournament with <span className="font-bold text-foreground">16 players</span> creates 8 first-round matches.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">🎲 Random Seeding</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                When a tournament starts, all players are <span className="font-bold text-foreground">randomly shuffled</span> and assigned to positions in the bracket. This ensures fair matchups where no one has an inherent advantage.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">🏟️ Tournament Structure</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The tournament uses a <span className="font-bold text-foreground">single-elimination bracket</span> divided into two wings (Wing A and Wing B). Players progress through rounds until the final showdown.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">📊 Example: 16-Player Bracket</h3>
              <ul className="text-muted-foreground text-sm space-y-2">
                <li>• <span className="font-bold text-foreground">Round 1:</span> 8 matches (16 players)</li>
                <li>• <span className="font-bold text-foreground">Quarterfinals:</span> 4 matches (8 players)</li>
                <li>• <span className="font-bold text-foreground">Semifinals:</span> 2 matches (4 players)</li>
                <li>• <span className="font-bold text-foreground">Wing Finals:</span> 1 match per wing</li>
                <li>• <span className="font-bold text-foreground">Grand Final:</span> Wing A Champion vs Wing B Champion</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">🖼️ Tournament Bracket</h3>
              <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                <img 
                  src={tournamentBracket} 
                  alt="Tournament Bracket showing Wing A and Wing B structure" 
                  className="w-full h-auto"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Wing A & Wing B bracket visualization
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">✅ Ready System</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Once paired, both players must click <span className="font-bold text-foreground">"Ready"</span> to start their match. This ensures both players are present and prepared before gameplay begins.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Feedback Sheet */}
      <Sheet open={showFeedback} onOpenChange={setShowFeedback}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              Send Feedback
            </SheetTitle>
            <SheetDescription>
              We'd love to hear your thoughts!
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Name *</label>
              <Input
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                placeholder="Enter your name"
                className="bg-muted border-0"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email (optional)</label>
              <Input
                type="email"
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-muted border-0"
              />
              <p className="text-xs text-muted-foreground">
                If you'd like us to respond to your feedback
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message *</label>
              <Textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Tell us what you think..."
                className="bg-muted border-0 min-h-[120px]"
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {feedbackMessage.length}/1000
              </p>
            </div>

            <button
              onClick={handleSendFeedback}
              disabled={isSendingFeedback || !feedbackName.trim() || !feedbackMessage.trim()}
              className="btn-game-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingFeedback ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Feedback
                </>
              )}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="container max-w-lg mx-auto px-4 pt-20 pb-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-4">
            <Hash className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">TicTacToe</h1>
          <p className="text-muted-foreground">Bringing back childhood memories! 😊</p>
        </motion.div>

        {/* Feature Pills */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {["Bidding System", "Best of 3", "Tournaments"].map((feature, i) => (
            <span 
              key={feature}
              className="px-3 py-1.5 bg-muted rounded-full text-xs font-medium text-muted-foreground"
            >
              {feature}
            </span>
          ))}
        </motion.div>

        {/* Create Tournament Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="game-card mb-4"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Create Tournament</h2>
              <p className="text-sm text-muted-foreground">
                Host a tournament and compete with friends in a bracket-style competition
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onCreateTournament}
              className="btn-game-primary flex-1 flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              Create
            </button>
            <button 
              onClick={onJoinTournament}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-muted hover:bg-muted/80 font-semibold transition-all"
            >
              <UserPlus className="w-5 h-5" />
              Join
            </button>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-3">
            🎮 Free to play • Unlimited players
          </p>
        </motion.div>

        {/* Play vs Computer Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="game-card"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Gamepad2 className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Play vs Computer</h2>
              <p className="text-sm text-muted-foreground">
                Practice your skills against AI
              </p>
            </div>
          </div>

          {/* Difficulty Selection */}
          <div className="flex gap-2 mb-4">
            {difficulties.map((diff) => (
              <button
                key={diff.key}
                onClick={() => setSelectedDifficulty(diff.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 transition-all font-medium text-sm ${
                  selectedDifficulty === diff.key
                    ? `${diff.color} border-current`
                    : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {diff.icon}
                {diff.label}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => onPlayComputer(selectedDifficulty)}
            className="btn-game-primary w-full flex items-center justify-center gap-2"
          >
            <Gamepad2 className="w-5 h-5" />
            Start Game
          </button>
        </motion.div>

      </div>
    </div>
  );
}