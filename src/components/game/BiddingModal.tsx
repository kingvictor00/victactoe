import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, ArrowRight } from "lucide-react";

interface BiddingModalProps {
  isOpen: boolean;
  onSubmit: (bid: number) => void;
  maxBid: number;
}

export default function BiddingModal({ isOpen, onSubmit, maxBid }: BiddingModalProps) {
  const [bid, setBid] = useState(10);

  const handleSubmit = () => {
    if (bid > 0 && bid <= maxBid) {
      onSubmit(bid);
      setBid(10);
    }
  };

  const quickBids = [5, 10, 25, 50];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="game-card w-full max-w-sm text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center">
              <Coins className="w-8 h-8 text-foreground" />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Place Your Bid</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Higher bid wins the right to play. Both lose their bid amount.
            </p>

            {/* Quick Bid Buttons */}
            <div className="flex gap-2 justify-center mb-4">
              {quickBids.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBid(Math.min(amount, maxBid))}
                  disabled={amount > maxBid}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    bid === amount 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  } ${amount > maxBid ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Custom Bid Input */}
            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">$</span>
              <input
                type="number"
                value={bid}
                onChange={(e) => setBid(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxBid))}
                className="w-full p-4 pl-8 text-2xl font-bold text-center bg-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                min={1}
                max={maxBid}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                max ${maxBid}
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              value={bid}
              onChange={(e) => setBid(parseInt(e.target.value))}
              min={1}
              max={maxBid}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer mb-6 accent-primary"
            />

            <button
              onClick={handleSubmit}
              className="btn-game-primary w-full flex items-center justify-center gap-2"
            >
              Confirm Bid
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}