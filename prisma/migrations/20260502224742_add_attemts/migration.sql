-- CreateTable
CREATE TABLE `attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userAnswer` TEXT NOT NULL,
    `isCorrect` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attempts` ADD CONSTRAINT `attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempts` ADD CONSTRAINT `attempts_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
