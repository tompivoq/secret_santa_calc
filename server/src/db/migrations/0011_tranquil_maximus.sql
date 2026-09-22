CREATE TABLE `notes` (
	`person_id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
