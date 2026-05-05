-- CreateTable
CREATE TABLE `question_likes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,

    UNIQUE INDEX `question_likes_userId_questionId_key`(`userId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `question_likes` ADD CONSTRAINT `question_likes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_likes` ADD CONSTRAINT `question_likes_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
