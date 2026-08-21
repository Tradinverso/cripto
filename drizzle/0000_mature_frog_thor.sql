CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`installment_no` integer NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`document_id` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`plan` integer NOT NULL,
	`installment_amount` integer NOT NULL,
	`currency` text NOT NULL,
	`network` text DEFAULT '' NOT NULL,
	`wallet` text DEFAULT '' NOT NULL,
	`access_status` text DEFAULT 'active' NOT NULL,
	`contract_status` text DEFAULT 'pending' NOT NULL,
	`signed_pdf_url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
