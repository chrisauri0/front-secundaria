import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  constructor(public dialog: ConfirmDialogService) {}

  cancel(): void {
    this.dialog.resolve(false);
  }

  confirm(): void {
    this.dialog.resolve(true);
  }
}
