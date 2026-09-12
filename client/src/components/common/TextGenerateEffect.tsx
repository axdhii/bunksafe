import React from 'react';
import { motion } from 'framer-motion';

export const TextGenerateEffect: React.FC<{
  words: string;
  className?: string;
  highlightWords?: string[];
}> = ({ words, className = '', highlightWords = [] }) => {
  const wordsArray = words.split(' ');

  return (
    <div className={`font-medium ${className}`}>
      {wordsArray.map((word, idx) => {
        const isHighlight = highlightWords.some(
          (hw) => word.toLowerCase().includes(hw.toLowerCase())
        );

        return (
          <motion.span
            key={word + idx}
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.35, delay: idx * 0.05 }}
            className={`inline-block mr-1.5 ${
              isHighlight ? 'text-white font-bold' : 'text-zinc-300 font-sub font-light'
            }`}
          >
            {word}
          </motion.span>
        );
      })}
    </div>
  );
};
