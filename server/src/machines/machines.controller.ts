import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { MachinesService } from './machines.service';

const UUID_PATTERN =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export class RegisterMachineDto {
  @IsString()
  @Matches(UUID_PATTERN, {
    message: 'uuid must match XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
  })
  uuid: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

@ApiTags('Machines')
@ApiBearerAuth()
@Controller('machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  /**
   * Register or update a machine entry.
   *
   * Called by the automated setup script after it detects the machine UUID
   * and hostname. If the user already has a record for this UUID the name is
   * updated in place (idempotent).
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Register or update a machine entry' })
  @ApiBody({ type: RegisterMachineDto })
  @ApiResponse({ status: 201, description: 'Machine registered or updated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async register(
    @Body() dto: RegisterMachineDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.machinesService.registerMachine(
      req.user.userId,
      dto.uuid.toUpperCase(),
      dto.name,
    );
  }

  /** List all machines registered by the authenticated user. */
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List registered machines for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Array of machine entries.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async list(@Request() req: { user: AuthenticatedUser }) {
    return this.machinesService.listMachinesForUser(req.user.userId);
  }
}
