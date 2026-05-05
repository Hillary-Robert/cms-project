-- CreateTable
CREATE TABLE `bookmarks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,

    UNIQUE INDEX `bookmarks_userId_questionId_key`(`userId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
